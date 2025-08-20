import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

interface BlogComment {
  id: number;
  author: string;
  avatar: string;
  date: string;
  time: string;
  content: string;
  isReply?: boolean;
}

interface BlogPost {
  id: number;
  title: string;
  date: string;
  author: string;
  authorAvatar: string;
  image: string;
  content: string;
  views: string;
  comments: number;
  tags: string[];
}

@Component({
  selector: 'app-blog-single',
  templateUrl: './blog-single.component.html',
  styleUrls: ['./blog-single.component.scss']
})
export class BlogSingleComponent implements OnInit {

  blogPost: BlogPost = {
    id: 1,
    title: 'More than 80 clinical trials launch to test of the coronavirus.',
    date: '03 Feb 2019',
    author: 'Naimur Rahman',
    authorAvatar: 'assets/img/author1.jpg',
    image: 'assets/img/blog1.jpg',
    content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse facilisis ultricies tortor, nec sollicitudin lorem sagittis vitae. Curabitur rhoncus commodo rutrum. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Aliquam nec lacus pulvinar, laoreet dolor quis, pellentesque ante. Cras nulla orci, pharetra at dictum consequat, pretium pretium nulla. Suspendisse porttitor nunc a sodales tempor. Mauris sed felis maximus, interdum metus vel, tincidunt diam.

Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Aliquam nec lacus pulvinar, laoreet dolor quis, pellentesque ante. Cras nulla orci, pharetra at dictum consequat, pretium pretium nulla. Suspendisse porttitor nunc a sodales tempor. Mauris sed felis maximus, interdum metus vel, tincidunt diam. Nam ac risus vitae sem vehicula egestas. Sed velit nulla, viverra non commod

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse facilisis ultricies tortor, nec sollicitudin lorem sagittis vitae. Curabitur rhoncus commodo rutrum. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Aliquam nec lacus pulvinar, laoreet dolor quis, pellentesque ante. Cras nulla orci, pharetra at dictum consequat, pretium pretium nulla. Suspendisse porttitor nunc a sodales tempor. Mauris sed felis maximus, interdum metus vel, tincidunt diam.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse facilisis ultricies tortor, nec sollicitudin lorem sagittis vitae. Curabitur rhoncus commodo rutrum. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Aliquam nec lacus pulvinar, laoreet dolor quis, pellentesque ante. Cras nulla orci, pharetra at dictum consequat, pretium pretium nulla. Suspendisse`,
    views: '33K',
    comments: 5,
    tags: ['business', 'wordpress', 'html', 'multipurpose', 'education']
  };

  comments: BlogComment[] = [
    {
      id: 1,
      author: 'Afsana Mimi',
      avatar: 'assets/img/author1.jpg',
      date: 'March 05, 2019',
      time: '03:38 AM',
      content: 'Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words Mirum est notare quam littera gothica, quam nunc putamus parum claram, anteposuerit litterarum formas'
    },
    {
      id: 2,
      author: 'Naimur Rahman',
      avatar: 'assets/img/author2.jpg',
      date: 'March 05, 2019',
      time: '03:38 AM',
      content: 'Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words Mirum est notare quam littera gothica, quam nunc putamus parum claram, anteposuerit litterarum formas',
      isReply: true
    },
    {
      id: 3,
      author: 'Suriya Molharta',
      avatar: 'assets/img/author3.jpg',
      date: 'March 05, 2019',
      time: '03:38 AM',
      content: 'Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words Mirum est notare quam littera gothica, quam nunc putamus parum claram, anteposuerit litterarum formas'
    }
  ];

  recentPosts = [
    {
      id: 7,
      title: 'We have announced our new product.',
      date: 'Jan 11, 2020',
      image: 'assets/img/blog-sidebar1.jpg',
      comments: 35
    },
    {
      id: 8,
      title: 'Top five way for solving teeth problems.',
      date: 'Mar 05, 2019',
      image: 'assets/img/blog-sidebar2.jpg',
      comments: 59
    },
    {
      id: 9,
      title: 'We provide highly business solutions.',
      date: 'June 09, 2019',
      image: 'assets/img/blog-sidebar3.jpg',
      comments: 44
    }
  ];

  categories = [
    'Men\'s Apparel',
    'Women\'s Apparel',
    'Bags Collection',
    'Accessories',
    'Sun Glasses'
  ];

  tags = [
    'business',
    'wordpress',
    'html',
    'multipurpose',
    'education',
    'template',
    'Ecommerce'
  ];

  // Comment form
  commentForm = {
    firstName: '',
    lastName: '',
    email: '',
    message: ''
  };

  constructor(
    private titleService: Title,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Блог - Детали');
    
    // Get blog ID from route params
    this.route.params.subscribe(params => {
      const blogId = +params['id'];
      if (blogId) {
        this.loadBlogPost(blogId);
      }
    });
  }

  loadBlogPost(id: number): void {
    // In a real app, this would fetch data from a service
    console.log('Loading blog post with ID:', id);
    // For now, just update the title with the ID
    this.blogPost.title = `Blog Post #${id} - ${this.blogPost.title}`;
  }

  onCommentSubmit(): void {
    if (this.commentForm.firstName && this.commentForm.lastName && 
        this.commentForm.email && this.commentForm.message) {
      
      const newComment: BlogComment = {
        id: this.comments.length + 1,
        author: `${this.commentForm.firstName} ${this.commentForm.lastName}`,
        avatar: 'assets/img/default-avatar.jpg',
        date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: '2-digit' 
        }),
        time: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        content: this.commentForm.message
      };

      this.comments.push(newComment);
      this.resetCommentForm();
      this.blogPost.comments++;
    }
  }

  resetCommentForm(): void {
    this.commentForm = {
      firstName: '',
      lastName: '',
      email: '',
      message: ''
    };
  }

  goToBlogsGrid(): void {
    this.router.navigate(['/home/blogs-grid']);
  }

  onSearch(event: any): void {
    const searchTerm = event.target.value;
    console.log('Search term:', searchTerm);
  }
}
